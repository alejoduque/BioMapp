import React from 'react';
import { withStyles } from '@mui/material/styles';
import Input from '@mui/material/Input';
import ResultsIcon from './../assets/results-icon.png'

class TopBar extends React.Component {
  state = {
    query: ''
  };

  handleChange = name => event => {
    if(event.target.value === '') this.props.clearSearch()
   this.setState({
     [name]: event.target.value,
   })
  }

  componentWillReceiveProps (nextProps) {
     if(nextProps.query !== this.props.query) {
       this.setState({ query: nextProps.query })
     }
  }

  render () {
    var icon = null
    if(this.state.query.length > 0) icon = <img className="w-4 h-4 m-2 mr-4" src={ResultsIcon} />
    console.log('bar props', this.props)
    return <div className="absolute pin-t pin-r m-2 mr-16 flex">
      {icon}
      <div className= "w-64">
        <Input
        onKeyPress={(ev) => {
          console.log(`Pressed keyCode ${ev.key}`);
          if (ev.key === 'Enter') {
            // Do code here
            this.props.searchMapData(this.state.query)
            ev.preventDefault();
          }
        }}
         placeholder="Buscar por texto, autor, o palabra"
         type="search"
         fullWidth
         value={this.state.query}
         className=""
         onChange={this.handleChange('query')}
         inputProps={{
           'aria-label': 'Description',
         }}
       />
      </div>
    </div>
  }
}

export default TopBar
